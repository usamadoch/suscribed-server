import { Router } from 'express';
import { seedDatabase } from '../controllers/SeedController.js';

const router = Router();

router.post('/', seedDatabase);

export default router;
