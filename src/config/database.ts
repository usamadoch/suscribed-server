import mongoose from 'mongoose';
import config from './index.js';

export const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(config.mongodb.uri);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        if (error instanceof Error) {
            console.error(`MongoDB Connection Error: ${error.message}`);
        }
        process.exit(1);
    }
};

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
    console.error(`MongoDB error: ${err}`);
});

export default mongoose;
