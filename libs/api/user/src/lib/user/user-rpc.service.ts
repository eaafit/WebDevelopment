import { Injectable } from '@nestjs/common';
import { UserService } from './user.service';
import type {
  GetProfileRequest,
  GetProfileResponse,
  GetUserByIdRequest,
  GetUserByIdResponse,
  ListUsersRequest,
  ListUsersResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from '@notary-portal/api-contracts';

@Injectable()
export class UserRpcService {
  constructor(private readonly userService: UserService) {}

  readonly getProfile    = (r: GetProfileRequest):    Promise<GetProfileResponse>    =>
    this.userService.getProfile(r);

  readonly updateProfile = (r: UpdateProfileRequest): Promise<UpdateProfileResponse> =>
    this.userService.updateProfile(r);

  readonly getUserById   = (r: GetUserByIdRequest):   Promise<GetUserByIdResponse>   =>
    this.userService.getUserById(r);

  readonly listUsers     = (r: ListUsersRequest):     Promise<ListUsersResponse>     =>
    this.userService.listUsers(r);
}
