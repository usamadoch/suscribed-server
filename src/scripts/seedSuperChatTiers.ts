import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SuperChatTier from '../models/SuperChatTier.js';

dotenv.config();


const defaultTiers = [
    { tierLevel: 1, tierLabel: 'Tier 1', minAmount: 100, maxAmount: 199, bgColor: '#1E88E5', textareaBg: 'transparent', textColor: '#ffffff', maxLength: 0, pinTimeMinutes: 0, pinTimeLabel: null, canMessage: false, textDark: false },
    { tierLevel: 2, tierLabel: 'Tier 2', minAmount: 200, maxAmount: 499, bgColor: '#00E5FF', textareaBg: '#30EAFF', textColor: '#000000', maxLength: 50, pinTimeMinutes: 0, pinTimeLabel: null, canMessage: true, textDark: true },
    { tierLevel: 3, tierLabel: 'Tier 3', minAmount: 500, maxAmount: 999, bgColor: '#1DE9B6', textareaBg: '#48EDC4', textColor: '#000000', maxLength: 150, pinTimeMinutes: 2, pinTimeLabel: '2 mins', canMessage: true, textDark: true },
    { tierLevel: 4, tierLabel: 'Tier 4', minAmount: 1000, maxAmount: 1999, bgColor: '#FFCA28', textareaBg: '#FFD450', textColor: '#000000', maxLength: 200, pinTimeMinutes: 5, pinTimeLabel: '5 mins', canMessage: true, textDark: true },
    { tierLevel: 5, tierLabel: 'Tier 5', minAmount: 2000, maxAmount: 4999, bgColor: '#F57C00', textareaBg: '#C76500', textColor: '#ffffff', maxLength: 225, pinTimeMinutes: 10, pinTimeLabel: '10 mins', canMessage: true, textDark: false },
    { tierLevel: 6, tierLabel: 'Tier 6', minAmount: 5000, maxAmount: 9999, bgColor: '#E91E63', textareaBg: '#BD1850', textColor: '#ffffff', maxLength: 250, pinTimeMinutes: 30, pinTimeLabel: '30 mins', canMessage: true, textDark: false },
    { tierLevel: 7, tierLabel: 'Tier 7', minAmount: 10000, maxAmount: 19999, bgColor: '#E62117', textareaBg: '#BB1B13', textColor: '#ffffff', maxLength: 270, pinTimeMinutes: 60, pinTimeLabel: '1 hr', canMessage: true, textDark: false },
    { tierLevel: 9, tierLabel: 'Tier 9', minAmount: 30000, maxAmount: 39999, bgColor: '#E62117', textareaBg: '#BB1B13', textColor: '#ffffff', maxLength: 290, pinTimeMinutes: 120, pinTimeLabel: '2 hrs', canMessage: true, textDark: false },
    { tierLevel: 10, tierLabel: 'Tier 10', minAmount: 40000, maxAmount: null, bgColor: '#E62117', textareaBg: '#BB1B13', textColor: '#ffffff', maxLength: 350, pinTimeMinutes: 300, pinTimeLabel: '5 hrs', canMessage: true, textDark: false },
];

const seedTiers = async () => {
    try {
        await mongoose.connect((process.env.MONGODB_URI) as string);
        console.log('Connected to MongoDB');

        await SuperChatTier.deleteMany({});
        console.log('Cleared existing SuperChat tiers');

        await SuperChatTier.insertMany(defaultTiers);
        console.log('Successfully seeded SuperChat tiers');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding SuperChat tiers:', error);
        process.exit(1);
    }
};

seedTiers();
