import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { PrismaService } from '@internal/prisma';
import { Injectable } from '@nestjs/common';
import {
  AssessmentSchema,
  AssessmentStatus as RpcAssessmentStatus,
  CitySchema,
  DistrictSchema,
  ElevatorType as RpcElevatorType,
  GetAssessmentResponseSchema,
  ListAssessmentsResponseSchema,
  ListCitiesResponseSchema,
  ListDistrictsResponseSchema,
  PaginationMetaSchema,
  RealEstateCondition as RpcRealEstateCondition,
  RealEstateObjectSchema,
  RealEstateObjectType as RpcRealEstateObjectType,
  WallMaterial as RpcWallMaterial,
  type Assessment as RpcAssessment,
  type City as RpcCity,
  type District as RpcDistrict,
  type GetAssessmentResponse,
  type ListAssessmentsResponse,
  type ListCitiesResponse,
  type ListDistrictsResponse,
  type RealEstateObject as RpcRealEstateObject,
} from '@notary-portal/api-contracts';
import {
  AssessmentStatus as PrismaAssessmentStatus,
  ElevatorType as PrismaElevatorType,
  RealEstateCondition as PrismaRealEstateCondition,
  RealEstateObjectType as PrismaRealEstateObjectType,
  WallMaterial as PrismaWallMaterial,
  type Prisma,
} from '@internal/prisma-client';
import type { AssessmentQuery } from './assessment.query';

export interface AssessmentRealEstateObjectData {
  cityId?: string;
  districtId?: string | null;
  address?: string;
  cadastralNumber?: string | null;
  area?: string;
  objectType?: RpcRealEstateObjectType;
  roomsCount?: number;
  floorsTotal?: number;
  floor?: number;
  condition?: RpcRealEstateCondition | null;
  yearBuilt?: number;
  wallMaterial?: RpcWallMaterial | null;
  elevatorType?: RpcElevatorType | null;
  hasBalconyOrLoggia?: boolean;
  landCategory?: string | null;
  permittedUse?: string | null;
  utilities?: string | null;
  description?: string | null;
}

export interface CreateAssessmentData {
  userId: string;
  address: string;
  description?: string;
  realEstateObject?: AssessmentRealEstateObjectData;
}

export interface UpdateAssessmentData {
  address?: string;
  description?: string;
  realEstateObject?: AssessmentRealEstateObjectData;
}

type PrismaCityRow = {
  id: string;
  name: string;
};

type PrismaDistrictRow = {
  id: string;
  cityId: string;
  name: string;
};

type PrismaRealEstateObjectRow = Prisma.RealEstateObjectGetPayload<{
  include: {
    city: true;
    district: true;
  };
}>;

type PrismaAssessmentRow = Prisma.AssessmentGetPayload<{
  include: {
    realEstateObject: {
      include: {
        city: true;
        district: true;
      };
    };
  };
}>;

const assessmentInclude = {
  realEstateObject: {
    include: {
      city: true,
      district: true,
    },
  },
} satisfies Prisma.AssessmentInclude;

@Injectable()
export class AssessmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listCities(): Promise<ListCitiesResponse> {
    const cities = await this.prisma.city.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return create(ListCitiesResponseSchema, {
      cities: cities.map((city) => this.toCityMessage(city)),
    });
  }

  async listDistricts(cityId?: string): Promise<ListDistrictsResponse> {
    const where: Prisma.DistrictWhereInput = {};
    if (cityId) where.cityId = cityId;

    const orderBy: Prisma.DistrictOrderByWithRelationInput[] = [{ name: 'asc' }];
    if (!cityId) orderBy.push({ cityId: 'asc' });

    const districts = await this.prisma.district.findMany({
      where,
      select: { id: true, cityId: true, name: true },
      orderBy,
    });

    return create(ListDistrictsResponseSchema, {
      districts: districts.map((district) => this.toDistrictMessage(district)),
    });
  }

  async listAssessments(query: AssessmentQuery): Promise<ListAssessmentsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);

    const [totalItems, assessments] = await this.prisma.$transaction([
      this.prisma.assessment.count({ where }),
      this.prisma.assessment.findMany({
        where,
        include: assessmentInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return create(ListAssessmentsResponseSchema, {
      assessments: assessments.map((assessment) => this.toMessage(assessment)),
      meta: create(PaginationMetaSchema, {
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
        currentPage: page,
        perPage: limit,
      }),
    });
  }

  async getAssessment(id: string): Promise<GetAssessmentResponse> {
    const assessment = await this.prisma.assessment.findUniqueOrThrow({
      where: { id },
      include: assessmentInclude,
    });

    return create(GetAssessmentResponseSchema, { assessment: this.toMessage(assessment) });
  }

  async createAssessment(data: CreateAssessmentData): Promise<RpcAssessment> {
    const assessment = await this.prisma.$transaction(async (tx) => {
      let realEstateObjectId: string | undefined;

      if (data.realEstateObject) {
        const realEstateObject = await tx.realEstateObject.create({
          data: this.toRealEstateObjectCreateInput(data.realEstateObject),
          select: { id: true },
        });
        realEstateObjectId = realEstateObject.id;
      }

      return tx.assessment.create({
        data: {
          userId: data.userId,
          address: data.address,
          description: data.description,
          ...(realEstateObjectId && { realEstateObjectId }),
        },
        include: assessmentInclude,
      });
    });

    return this.toMessage(assessment);
  }

  async updateAssessment(id: string, data: UpdateAssessmentData): Promise<RpcAssessment> {
    const assessment = await this.prisma.$transaction(async (tx) => {
      const currentAssessment = await tx.assessment.findUniqueOrThrow({
        where: { id },
        select: { realEstateObjectId: true },
      });

      let realEstateObjectId = currentAssessment.realEstateObjectId;

      if (data.realEstateObject) {
        if (realEstateObjectId) {
          await tx.realEstateObject.update({
            where: { id: realEstateObjectId },
            data: this.toRealEstateObjectUpdateInput(data.realEstateObject),
          });
        } else {
          const realEstateObject = await tx.realEstateObject.create({
            data: this.toRealEstateObjectCreateInput(data.realEstateObject),
            select: { id: true },
          });
          realEstateObjectId = realEstateObject.id;
        }
      }

      return tx.assessment.update({
        where: { id },
        data: {
          ...(data.address !== undefined && { address: data.address }),
          ...(data.description !== undefined && { description: data.description }),
          ...(realEstateObjectId &&
            currentAssessment.realEstateObjectId !== realEstateObjectId && {
              realEstateObjectId,
            }),
        },
        include: assessmentInclude,
      });
    });

    return this.toMessage(assessment);
  }

  async verifyAssessment(id: string, notaryId?: string | null): Promise<RpcAssessment> {
    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: {
        status: PrismaAssessmentStatus.Verified,
        ...(notaryId != null && notaryId !== '' && { notaryId }),
      },
      include: assessmentInclude,
    });
    return this.toMessage(assessment);
  }

  async completeAssessment(id: string, estimatedValue: string): Promise<RpcAssessment> {
    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: { status: PrismaAssessmentStatus.Completed, estimatedValue },
      include: assessmentInclude,
    });
    return this.toMessage(assessment);
  }

  async cancelAssessment(id: string, reason?: string): Promise<RpcAssessment> {
    const assessment = await this.prisma.assessment.update({
      where: { id },
      data: { status: PrismaAssessmentStatus.Cancelled, cancelReason: reason },
      include: assessmentInclude,
    });
    return this.toMessage(assessment);
  }

  private buildWhere(query: AssessmentQuery): Prisma.AssessmentWhereInput {
    const where: Prisma.AssessmentWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.notaryId) where.notaryId = query.notaryId;
    if (query.status) where.status = this.toPrismaStatus(query.status);
    if (query.createdAtFrom || query.createdAtTo) {
      where.createdAt = {
        ...(query.createdAtFrom && { gte: query.createdAtFrom }),
        ...(query.createdAtTo && { lte: query.createdAtTo }),
      };
    }
    return where;
  }

  private buildOrderBy(query: AssessmentQuery): Prisma.AssessmentOrderByWithRelationInput {
    const direction = query.sortDesc ? 'desc' : 'asc';
    switch (query.sortField) {
      case 'estimatedValue':
        return { estimatedValue: direction };
      case 'updatedAt':
        return { updatedAt: direction };
      default:
        return { createdAt: 'desc' };
    }
  }

  private toMessage(assessment: PrismaAssessmentRow): RpcAssessment {
    return create(AssessmentSchema, {
      id: assessment.id,
      userId: assessment.userId,
      status: this.fromPrismaStatus(assessment.status),
      address: assessment.address,
      description: assessment.description ?? '',
      estimatedValue: assessment.estimatedValue?.toString() ?? '',
      createdAt: timestampFromDate(assessment.createdAt),
      updatedAt: timestampFromDate(assessment.updatedAt),
      ...(assessment.realEstateObjectId && { realEstateObjectId: assessment.realEstateObjectId }),
      ...(assessment.realEstateObject && {
        realEstateObject: this.toRealEstateObjectMessage(assessment.realEstateObject),
      }),
    });
  }

  private toCityMessage(city: PrismaCityRow): RpcCity {
    return create(CitySchema, {
      id: city.id,
      name: city.name,
    });
  }

  private toDistrictMessage(district: PrismaDistrictRow): RpcDistrict {
    return create(DistrictSchema, {
      id: district.id,
      cityId: district.cityId,
      name: district.name,
    });
  }

  private toRealEstateObjectMessage(
    realEstateObject: PrismaRealEstateObjectRow,
  ): RpcRealEstateObject {
    return create(RealEstateObjectSchema, {
      id: realEstateObject.id,
      cityId: realEstateObject.cityId,
      address: realEstateObject.address,
      area: realEstateObject.area.toString(),
      objectType: this.fromPrismaRealEstateObjectType(realEstateObject.objectType),
      city: this.toCityMessage(realEstateObject.city),
      createdAt: timestampFromDate(realEstateObject.createdAt),
      updatedAt: timestampFromDate(realEstateObject.updatedAt),
      ...(realEstateObject.districtId && { districtId: realEstateObject.districtId }),
      ...(realEstateObject.cadastralNumber && {
        cadastralNumber: realEstateObject.cadastralNumber,
      }),
      ...(realEstateObject.roomsCount !== null && { roomsCount: realEstateObject.roomsCount }),
      ...(realEstateObject.floorsTotal !== null && {
        floorsTotal: realEstateObject.floorsTotal,
      }),
      ...(realEstateObject.floor !== null && { floor: realEstateObject.floor }),
      ...(realEstateObject.condition !== null && {
        condition: this.fromPrismaRealEstateCondition(realEstateObject.condition),
      }),
      ...(realEstateObject.yearBuilt !== null && { yearBuilt: realEstateObject.yearBuilt }),
      ...(realEstateObject.wallMaterial !== null && {
        wallMaterial: this.fromPrismaWallMaterial(realEstateObject.wallMaterial),
      }),
      ...(realEstateObject.elevatorType !== null && {
        elevatorType: this.fromPrismaElevatorType(realEstateObject.elevatorType),
      }),
      ...(realEstateObject.hasBalconyOrLoggia !== null && {
        hasBalconyOrLoggia: realEstateObject.hasBalconyOrLoggia,
      }),
      ...(realEstateObject.landCategory && { landCategory: realEstateObject.landCategory }),
      ...(realEstateObject.permittedUse && { permittedUse: realEstateObject.permittedUse }),
      ...(realEstateObject.utilities && { utilities: realEstateObject.utilities }),
      ...(realEstateObject.description && { description: realEstateObject.description }),
      ...(realEstateObject.district && {
        district: this.toDistrictMessage(realEstateObject.district),
      }),
    });
  }

  private toRealEstateObjectCreateInput(
    data: AssessmentRealEstateObjectData,
  ): Prisma.RealEstateObjectUncheckedCreateWithoutAssessmentInput {
    return {
      cityId: requireDefined(data.cityId, 'real_estate_object.city_id'),
      address: requireDefined(data.address, 'real_estate_object.address'),
      area: requireDefined(data.area, 'real_estate_object.area'),
      objectType: this.toPrismaRealEstateObjectType(
        requireDefined(data.objectType, 'real_estate_object.object_type'),
      ),
      ...(data.districtId !== undefined && { districtId: data.districtId }),
      ...(data.cadastralNumber !== undefined && { cadastralNumber: data.cadastralNumber }),
      ...(data.roomsCount !== undefined && { roomsCount: data.roomsCount }),
      ...(data.floorsTotal !== undefined && { floorsTotal: data.floorsTotal }),
      ...(data.floor !== undefined && { floor: data.floor }),
      ...(data.condition !== undefined && {
        condition:
          data.condition === null ? null : this.toPrismaRealEstateCondition(data.condition),
      }),
      ...(data.yearBuilt !== undefined && { yearBuilt: data.yearBuilt }),
      ...(data.wallMaterial !== undefined && {
        wallMaterial:
          data.wallMaterial === null ? null : this.toPrismaWallMaterial(data.wallMaterial),
      }),
      ...(data.elevatorType !== undefined && {
        elevatorType:
          data.elevatorType === null ? null : this.toPrismaElevatorType(data.elevatorType),
      }),
      ...(data.hasBalconyOrLoggia !== undefined && {
        hasBalconyOrLoggia: data.hasBalconyOrLoggia,
      }),
      ...(data.landCategory !== undefined && { landCategory: data.landCategory }),
      ...(data.permittedUse !== undefined && { permittedUse: data.permittedUse }),
      ...(data.utilities !== undefined && { utilities: data.utilities }),
      ...(data.description !== undefined && { description: data.description }),
    };
  }

  private toRealEstateObjectUpdateInput(
    data: AssessmentRealEstateObjectData,
  ): Prisma.RealEstateObjectUncheckedUpdateWithoutAssessmentInput {
    const updateData: Prisma.RealEstateObjectUncheckedUpdateWithoutAssessmentInput = {};

    if (data.cityId !== undefined) updateData.cityId = data.cityId;
    if (data.districtId !== undefined) updateData.districtId = data.districtId;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.cadastralNumber !== undefined) updateData.cadastralNumber = data.cadastralNumber;
    if (data.area !== undefined) updateData.area = data.area;
    if (data.objectType !== undefined) {
      updateData.objectType = this.toPrismaRealEstateObjectType(data.objectType);
    }
    if (data.roomsCount !== undefined) updateData.roomsCount = data.roomsCount;
    if (data.floorsTotal !== undefined) updateData.floorsTotal = data.floorsTotal;
    if (data.floor !== undefined) updateData.floor = data.floor;
    if (data.condition !== undefined) {
      updateData.condition =
        data.condition === null ? null : this.toPrismaRealEstateCondition(data.condition);
    }
    if (data.yearBuilt !== undefined) updateData.yearBuilt = data.yearBuilt;
    if (data.wallMaterial !== undefined) {
      updateData.wallMaterial =
        data.wallMaterial === null ? null : this.toPrismaWallMaterial(data.wallMaterial);
    }
    if (data.elevatorType !== undefined) {
      updateData.elevatorType =
        data.elevatorType === null ? null : this.toPrismaElevatorType(data.elevatorType);
    }
    if (data.hasBalconyOrLoggia !== undefined) {
      updateData.hasBalconyOrLoggia = data.hasBalconyOrLoggia;
    }
    if (data.landCategory !== undefined) updateData.landCategory = data.landCategory;
    if (data.permittedUse !== undefined) updateData.permittedUse = data.permittedUse;
    if (data.utilities !== undefined) updateData.utilities = data.utilities;
    if (data.description !== undefined) updateData.description = data.description;

    return updateData;
  }

  private toPrismaStatus(status: RpcAssessmentStatus): PrismaAssessmentStatus {
    const map: Record<number, PrismaAssessmentStatus> = {
      [RpcAssessmentStatus.NEW]: PrismaAssessmentStatus.New,
      [RpcAssessmentStatus.VERIFIED]: PrismaAssessmentStatus.Verified,
      [RpcAssessmentStatus.IN_PROGRESS]: PrismaAssessmentStatus.InProgress,
      [RpcAssessmentStatus.COMPLETED]: PrismaAssessmentStatus.Completed,
      [RpcAssessmentStatus.CANCELLED]: PrismaAssessmentStatus.Cancelled,
    };
    const result = map[status];
    if (!result) throw new Error(`Unsupported assessment status: ${status}`);
    return result;
  }

  private fromPrismaStatus(status: PrismaAssessmentStatus): RpcAssessmentStatus {
    const map: Record<string, RpcAssessmentStatus> = {
      [PrismaAssessmentStatus.New]: RpcAssessmentStatus.NEW,
      [PrismaAssessmentStatus.Verified]: RpcAssessmentStatus.VERIFIED,
      [PrismaAssessmentStatus.InProgress]: RpcAssessmentStatus.IN_PROGRESS,
      [PrismaAssessmentStatus.Completed]: RpcAssessmentStatus.COMPLETED,
      [PrismaAssessmentStatus.Cancelled]: RpcAssessmentStatus.CANCELLED,
    };
    return map[status] ?? RpcAssessmentStatus.UNSPECIFIED;
  }

  private toPrismaRealEstateObjectType(type: RpcRealEstateObjectType): PrismaRealEstateObjectType {
    const map: Record<number, PrismaRealEstateObjectType> = {
      [RpcRealEstateObjectType.APARTMENT]: PrismaRealEstateObjectType.Apartment,
      [RpcRealEstateObjectType.HOUSE]: PrismaRealEstateObjectType.House,
      [RpcRealEstateObjectType.ROOM]: PrismaRealEstateObjectType.Room,
      [RpcRealEstateObjectType.APARTMENTS]: PrismaRealEstateObjectType.Apartments,
      [RpcRealEstateObjectType.LAND_PLOT]: PrismaRealEstateObjectType.LandPlot,
      [RpcRealEstateObjectType.COMMERCIAL_PROPERTY]: PrismaRealEstateObjectType.CommercialProperty,
      [RpcRealEstateObjectType.OTHER]: PrismaRealEstateObjectType.Other,
    };
    const result = map[type];
    if (!result) throw new Error(`Unsupported real estate object type: ${type}`);
    return result;
  }

  private fromPrismaRealEstateObjectType(
    type: PrismaRealEstateObjectType,
  ): RpcRealEstateObjectType {
    const map: Record<string, RpcRealEstateObjectType> = {
      [PrismaRealEstateObjectType.Apartment]: RpcRealEstateObjectType.APARTMENT,
      [PrismaRealEstateObjectType.House]: RpcRealEstateObjectType.HOUSE,
      [PrismaRealEstateObjectType.Room]: RpcRealEstateObjectType.ROOM,
      [PrismaRealEstateObjectType.Apartments]: RpcRealEstateObjectType.APARTMENTS,
      [PrismaRealEstateObjectType.LandPlot]: RpcRealEstateObjectType.LAND_PLOT,
      [PrismaRealEstateObjectType.CommercialProperty]: RpcRealEstateObjectType.COMMERCIAL_PROPERTY,
      [PrismaRealEstateObjectType.Other]: RpcRealEstateObjectType.OTHER,
    };
    return map[type] ?? RpcRealEstateObjectType.UNSPECIFIED;
  }

  private toPrismaRealEstateCondition(
    condition: RpcRealEstateCondition,
  ): PrismaRealEstateCondition {
    const map: Record<number, PrismaRealEstateCondition> = {
      [RpcRealEstateCondition.EXCELLENT]: PrismaRealEstateCondition.Excellent,
      [RpcRealEstateCondition.GOOD]: PrismaRealEstateCondition.Good,
      [RpcRealEstateCondition.SATISFACTORY]: PrismaRealEstateCondition.Satisfactory,
      [RpcRealEstateCondition.POOR]: PrismaRealEstateCondition.Poor,
    };
    const result = map[condition];
    if (!result) throw new Error(`Unsupported real estate condition: ${condition}`);
    return result;
  }

  private fromPrismaRealEstateCondition(
    condition: PrismaRealEstateCondition,
  ): RpcRealEstateCondition {
    const map: Record<string, RpcRealEstateCondition> = {
      [PrismaRealEstateCondition.Excellent]: RpcRealEstateCondition.EXCELLENT,
      [PrismaRealEstateCondition.Good]: RpcRealEstateCondition.GOOD,
      [PrismaRealEstateCondition.Satisfactory]: RpcRealEstateCondition.SATISFACTORY,
      [PrismaRealEstateCondition.Poor]: RpcRealEstateCondition.POOR,
    };
    return map[condition] ?? RpcRealEstateCondition.UNSPECIFIED;
  }

  private toPrismaWallMaterial(material: RpcWallMaterial): PrismaWallMaterial {
    const map: Record<number, PrismaWallMaterial> = {
      [RpcWallMaterial.BRICK]: PrismaWallMaterial.Brick,
      [RpcWallMaterial.PANEL]: PrismaWallMaterial.Panel,
      [RpcWallMaterial.BLOCK]: PrismaWallMaterial.Block,
      [RpcWallMaterial.MONOLITHIC]: PrismaWallMaterial.Monolithic,
      [RpcWallMaterial.MONOLITHIC_BRICK]: PrismaWallMaterial.MonolithicBrick,
      [RpcWallMaterial.WOODEN]: PrismaWallMaterial.Wooden,
      [RpcWallMaterial.AERATED_CONCRETE]: PrismaWallMaterial.AeratedConcrete,
    };
    const result = map[material];
    if (!result) throw new Error(`Unsupported wall material: ${material}`);
    return result;
  }

  private fromPrismaWallMaterial(material: PrismaWallMaterial): RpcWallMaterial {
    const map: Record<string, RpcWallMaterial> = {
      [PrismaWallMaterial.Brick]: RpcWallMaterial.BRICK,
      [PrismaWallMaterial.Panel]: RpcWallMaterial.PANEL,
      [PrismaWallMaterial.Block]: RpcWallMaterial.BLOCK,
      [PrismaWallMaterial.Monolithic]: RpcWallMaterial.MONOLITHIC,
      [PrismaWallMaterial.MonolithicBrick]: RpcWallMaterial.MONOLITHIC_BRICK,
      [PrismaWallMaterial.Wooden]: RpcWallMaterial.WOODEN,
      [PrismaWallMaterial.AeratedConcrete]: RpcWallMaterial.AERATED_CONCRETE,
    };
    return map[material] ?? RpcWallMaterial.UNSPECIFIED;
  }

  private toPrismaElevatorType(type: RpcElevatorType): PrismaElevatorType {
    const map: Record<number, PrismaElevatorType> = {
      [RpcElevatorType.NONE]: PrismaElevatorType.None,
      [RpcElevatorType.CARGO]: PrismaElevatorType.Cargo,
      [RpcElevatorType.PASSENGER]: PrismaElevatorType.Passenger,
      [RpcElevatorType.PASSENGER_AND_CARGO]: PrismaElevatorType.PassengerAndCargo,
    };
    const result = map[type];
    if (!result) throw new Error(`Unsupported elevator type: ${type}`);
    return result;
  }

  private fromPrismaElevatorType(type: PrismaElevatorType): RpcElevatorType {
    const map: Record<string, RpcElevatorType> = {
      [PrismaElevatorType.None]: RpcElevatorType.NONE,
      [PrismaElevatorType.Cargo]: RpcElevatorType.CARGO,
      [PrismaElevatorType.Passenger]: RpcElevatorType.PASSENGER,
      [PrismaElevatorType.PassengerAndCargo]: RpcElevatorType.PASSENGER_AND_CARGO,
    };
    return map[type] ?? RpcElevatorType.UNSPECIFIED;
  }
}

function requireDefined<T>(value: T | undefined, fieldName: string): T {
  if (value === undefined) {
    throw new ConnectError(`${fieldName} is required`, Code.InvalidArgument);
  }
  return value;
}
