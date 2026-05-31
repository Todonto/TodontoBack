import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/tokenUtil';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token!);
    if (!decoded) {
        return res.status(401).json({ message: 'Invalid token' });
    }
    (req as any).user = decoded;
    next();
};