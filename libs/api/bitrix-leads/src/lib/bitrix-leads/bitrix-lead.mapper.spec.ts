import { buildLeadFields, type AssessmentLike, type UserLike } from './bitrix-lead.mapper';

function baseAssessment(overrides: Partial<AssessmentLike> = {}): AssessmentLike {
  return {
    id: 'abc12345-aaaa-bbbb-cccc-000000000001',
    address: 'Москва, ул. Тверская, 1',
    description: null,
    estimatedValue: null,
    ...overrides,
  };
}

function baseUser(overrides: Partial<UserLike> = {}): UserLike {
  return {
    fullName: 'Иванов Иван Иванович',
    email: 'ivan@example.com',
    phoneNumber: '+79991234567',
    ...overrides,
  };
}

describe('buildLeadFields', () => {
  describe('happy path', () => {
    it('maps full assessment + user to all expected Bitrix fields', () => {
      const result = buildLeadFields(
        baseAssessment({ description: 'Срочно оценить', estimatedValue: '1500000.50' }),
        baseUser(),
      );

      expect(result).toEqual({
        TITLE: 'Заявка abc12345 — Москва, ул. Тверская, 1',
        UF_CRM_ASSESSMENT_ID: 'abc12345-aaaa-bbbb-cccc-000000000001',
        LAST_NAME: 'Иванов',
        NAME: 'Иван',
        SECOND_NAME: 'Иванович',
        EMAIL: [{ VALUE: 'ivan@example.com', VALUE_TYPE: 'WORK' }],
        PHONE: [{ VALUE: '+79991234567', VALUE_TYPE: 'WORK' }],
        ADDRESS: 'Москва, ул. Тверская, 1',
        COMMENTS: 'Срочно оценить',
        OPPORTUNITY: 1500000.5,
        CURRENCY_ID: 'RUB',
        SOURCE_ID: 'WEB',
        STATUS_ID: 'NEW',
      });
    });
  });

  describe('fullName parsing', () => {
    it.each([
      [
        'Иванов Иван Иванович',
        { LAST_NAME: 'Иванов', NAME: 'Иван', SECOND_NAME: 'Иванович' },
      ],
      [
        'Иванов Иван',
        { LAST_NAME: 'Иванов', NAME: 'Иван', SECOND_NAME: undefined },
      ],
      [
        'Иванов',
        { LAST_NAME: 'Иванов', NAME: undefined, SECOND_NAME: undefined },
      ],
      [
        'Петров-Сидоров Иван',
        { LAST_NAME: 'Петров-Сидоров', NAME: 'Иван', SECOND_NAME: undefined },
      ],
      [
        '  Иванов   Иван  ',
        { LAST_NAME: 'Иванов', NAME: 'Иван', SECOND_NAME: undefined },
      ],
      [
        'Иванов Иван Иванович Младший',
        {
          LAST_NAME: 'Иванов',
          NAME: 'Иван',
          SECOND_NAME: 'Иванович Младший',
        },
      ],
    ])('parses %p correctly', (fullName, expected) => {
      const result = buildLeadFields(baseAssessment(), baseUser({ fullName }));
      expect(result.LAST_NAME).toBe(expected.LAST_NAME);
      expect(result.NAME).toBe(expected.NAME);
      expect(result.SECOND_NAME).toBe(expected.SECOND_NAME);
    });

    it('omits all name fields when fullName is empty / whitespace-only', () => {
      const empty = buildLeadFields(baseAssessment(), baseUser({ fullName: '' }));
      const ws = buildLeadFields(baseAssessment(), baseUser({ fullName: '   \t  ' }));

      for (const result of [empty, ws]) {
        expect(result.LAST_NAME).toBeUndefined();
        expect(result.NAME).toBeUndefined();
        expect(result.SECOND_NAME).toBeUndefined();
      }
    });
  });

  describe('phone', () => {
    it('wraps non-empty phoneNumber in WORK multifield', () => {
      const result = buildLeadFields(
        baseAssessment(),
        baseUser({ phoneNumber: '+79991234567' }),
      );
      expect(result.PHONE).toEqual([{ VALUE: '+79991234567', VALUE_TYPE: 'WORK' }]);
    });

    it.each([null, undefined, '', '   '])(
      'omits PHONE when phoneNumber is %p',
      (input) => {
        const result = buildLeadFields(
          baseAssessment(),
          baseUser({ phoneNumber: input as string | null }),
        );
        expect(result.PHONE).toBeUndefined();
      },
    );

    it('trims surrounding whitespace from phoneNumber', () => {
      const result = buildLeadFields(
        baseAssessment(),
        baseUser({ phoneNumber: '  +79991234567  ' }),
      );
      expect(result.PHONE).toEqual([{ VALUE: '+79991234567', VALUE_TYPE: 'WORK' }]);
    });
  });

  describe('address & TITLE', () => {
    it('includes address in TITLE and ADDRESS when present', () => {
      const result = buildLeadFields(
        baseAssessment({ id: '12345678-aaaa-bbbb', address: 'СПб, Невский, 10' }),
        baseUser(),
      );
      expect(result.TITLE).toBe('Заявка 12345678 — СПб, Невский, 10');
      expect(result.ADDRESS).toBe('СПб, Невский, 10');
    });

    it('falls back to short-id-only TITLE when address is whitespace', () => {
      const result = buildLeadFields(
        baseAssessment({ id: '12345678-aaaa-bbbb', address: '   ' }),
        baseUser(),
      );
      expect(result.TITLE).toBe('Заявка 12345678');
      expect(result.ADDRESS).toBeUndefined();
    });

    it('trims address before using in TITLE and ADDRESS', () => {
      const result = buildLeadFields(
        baseAssessment({ address: '  Москва, Тверская, 1  ' }),
        baseUser(),
      );
      expect(result.ADDRESS).toBe('Москва, Тверская, 1');
      expect(result.TITLE).toBe('Заявка abc12345 — Москва, Тверская, 1');
    });
  });

  describe('description / COMMENTS', () => {
    it('includes COMMENTS when description is non-empty', () => {
      const result = buildLeadFields(
        baseAssessment({ description: 'Перезвонить вечером' }),
        baseUser(),
      );
      expect(result.COMMENTS).toBe('Перезвонить вечером');
    });

    it.each([null, undefined, '', '  \n\t  '])(
      'omits COMMENTS when description is %p',
      (input) => {
        const result = buildLeadFields(
          baseAssessment({ description: input as string | null }),
          baseUser(),
        );
        expect(result.COMMENTS).toBeUndefined();
      },
    );

    it('trims surrounding whitespace from description', () => {
      const result = buildLeadFields(
        baseAssessment({ description: '  Срочно  ' }),
        baseUser(),
      );
      expect(result.COMMENTS).toBe('Срочно');
    });
  });

  describe('estimatedValue / OPPORTUNITY', () => {
    it.each<[string | number, number]>([
      ['1500000', 1500000],
      ['1500000.50', 1500000.5],
      [1500000, 1500000],
      ['0.01', 0.01],
      [42, 42],
    ])('parses valid value %p to %p', (input, expected) => {
      const result = buildLeadFields(
        baseAssessment({ estimatedValue: input }),
        baseUser(),
      );
      expect(result.OPPORTUNITY).toBe(expected);
    });

    it.each<string | number | null | undefined>([
      null,
      undefined,
      '',
      '0',
      0,
      'invalid',
      '-100',
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])('omits OPPORTUNITY when value is %p', (input) => {
      const result = buildLeadFields(
        baseAssessment({ estimatedValue: input }),
        baseUser(),
      );
      expect(result.OPPORTUNITY).toBeUndefined();
    });
  });

  describe('email', () => {
    it('always wraps email in WORK multifield', () => {
      const result = buildLeadFields(baseAssessment(), baseUser({ email: 'test@ex.ru' }));
      expect(result.EMAIL).toEqual([{ VALUE: 'test@ex.ru', VALUE_TYPE: 'WORK' }]);
    });
  });

  describe('constants', () => {
    it('always sets CURRENCY_ID=RUB, SOURCE_ID=WEB, STATUS_ID=NEW', () => {
      const result = buildLeadFields(baseAssessment(), baseUser());
      expect(result.CURRENCY_ID).toBe('RUB');
      expect(result.SOURCE_ID).toBe('WEB');
      expect(result.STATUS_ID).toBe('NEW');
    });

    it('UF_CRM_ASSESSMENT_ID is full UUID, not shortened', () => {
      const result = buildLeadFields(
        baseAssessment({ id: 'full-uuid-here-1234-567890abcdef' }),
        baseUser(),
      );
      expect(result.UF_CRM_ASSESSMENT_ID).toBe('full-uuid-here-1234-567890abcdef');
    });
  });
});
