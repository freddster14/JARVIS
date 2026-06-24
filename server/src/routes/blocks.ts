import { Router } from 'express';
import { getBlocks, createBlock, updateBlock, deleteBlock } from '../controllers/blocksController.js';

const router = Router();

router.get('/', getBlocks);
router.post('/', createBlock);
router.patch('/:id', updateBlock);
router.delete('/:id', deleteBlock);

export default router;
