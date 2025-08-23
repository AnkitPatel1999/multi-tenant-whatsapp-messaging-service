export default() => ({
    port: process.env.PORT || 3000,
    database: {
        url: process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/testdb',
    },
});