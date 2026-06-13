import { Router } from 'express'; const router = Router(); // TODO: Implement blog routes router.get('/', (req, res) => res.json({ success: true, message: 'blog routes' })); export default router;
