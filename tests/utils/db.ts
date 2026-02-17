
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

export const connect = async () => {
    // Prevent MongooseError: Can't call cleanup on an uninitialized MaybeCallback
    await mongoose.disconnect();

    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
};

export const closeDatabase = async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
};

export const clearDatabase = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
};
