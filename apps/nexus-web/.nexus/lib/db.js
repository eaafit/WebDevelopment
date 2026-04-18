// Database client placeholder
// Replace with your preferred ORM (Prisma, Drizzle, etc.)
export const db = {
    user: {
        async findFirst() {
            return { id: 1, name: 'Demo User', email: 'demo@nexusjs.dev' };
        },
        async findMany() {
            return [{ id: 1, name: 'Demo User', email: 'demo@nexusjs.dev' }];
        },
        async update(args) {
            return { ...args.data };
        },
        async create(args) {
            return args.data;
        },
    },
};
