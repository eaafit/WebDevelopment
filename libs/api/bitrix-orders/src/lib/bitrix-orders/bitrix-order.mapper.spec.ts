import { buildOrderFields, type LeadLike } from './bitrix-order.mapper';

function baseLead(overrides: Partial<LeadLike> = {}): LeadLike {
    return {
        id: 'order-12345678-aaaa-bbbb-cccc-000000000001',
        totalAmount: 1000000,
        assessment: {
            id: 'ass-1',
            address: 'Москва, ул. Тверская, 1',
            description: 'Срочно',
        },
        applicant: {
            id: 'user-1',
            fullName: 'Иванов Иван',
            email: 'ivan@example.com',
            phoneNumber: '+79991234567',
        },
        ...overrides,
    };
}

describe('buildOrderFields', () => {
    describe('happy path', () => {
        it('creates basket with one item and required fields', () => {
            const result = buildOrderFields(baseLead());
            expect(result).toEqual({
                LID: 's1',
                PERSON_TYPE_ID: 1,
                BASKET: [
                    {
                        NAME: 'Оценка недвижимости (заказ order-12)',
                        QUANTITY: 1,
                        PRICE: 1000000,
                        CURRENCY: 'RUB',
                    },
                ],
                CURRENCY: 'RUB',
                STATUS_ID: 'N',
                COMMENTS: 'Москва, ул. Тверская, 1\nСрочно',
                PRICE: 1000000,
            });
        });
    });

    describe('totalAmount handling', () => {
        it('omits PRICE when amount is 0', () => {
            const result = buildOrderFields(baseLead({ totalAmount: 0 }));
            expect(result.PRICE).toBeUndefined();
            expect(result.BASKET).toBeDefined();
            expect(result.BASKET![0].PRICE).toBe(0);
        });

        it('parses string amount', () => {
            const result = buildOrderFields(baseLead({ totalAmount: '2500000.50' }));
            expect(result.PRICE).toBe(2500000.5);
        });

        it('handles null or undefined amount', () => {
            const result = buildOrderFields(baseLead({ totalAmount: null }));
            expect(result.PRICE).toBeUndefined();
            expect(result.BASKET).toBeDefined();
            expect(result.BASKET![0].PRICE).toBe(0);
        });
    });

    describe('COMMENTS', () => {
        it('contains address and description, trimmed', () => {
            const result = buildOrderFields(baseLead({
                assessment: { id: 'ass-1', address: '  Москва  ', description: '  Срочно  ' },
            }));
            expect(result.COMMENTS).toBe('Москва\nСрочно');
        });

        it('omits COMMENTS when both address and description are empty', () => {
            const result = buildOrderFields(baseLead({ assessment: { id: 'ass-1', address: '   ', description: '' } }));
            expect(result.COMMENTS).toBeUndefined();
        });
    });
});