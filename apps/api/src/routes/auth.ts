import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { loginSchema, registerSchema, profileSchema } from '@lumen/shared';
import { User } from '../models/user';
import { asyncHandler, conflict, send, unauthorized } from '../lib/errors';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { clearRefreshCookie, setRefreshCookie, signAccessToken, verifyRefreshToken, REFRESH_COOKIE } from '../lib/jwt';
import { userToDTO } from '../lib/serialize';
import { Enrollment } from '../models/learning';

const router = Router();

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;
    const existing = await User.findOne({ email }).lean();
    if (existing) throw conflict('An account with that email already exists');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role });

    setRefreshCookie(res, String(user._id));
    return send(
      res,
      {
        user: userToDTO(user),
        accessToken: signAccessToken({ sub: String(user._id), role: user.role, name: user.name }),
      },
      201,
    );
  }),
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) throw unauthorized('Email or password is incorrect');
    if (user.status === 'suspended') throw unauthorized('This account is suspended');

    const ok = await bcrypt.compare(password, user.passwordHash as string);
    if (!ok) throw unauthorized('Email or password is incorrect');

    user.lastLoginAt = new Date() as any;
    await user.save();

    setRefreshCookie(res, String(user._id));
    return send(res, {
      user: userToDTO(user),
      accessToken: signAccessToken({ sub: String(user._id), role: user.role, name: user.name }),
    });
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw unauthorized('Session expired');
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw unauthorized('Session expired');
    }
    const user = await User.findById(payload.sub).lean();
    if (!user || user.status === 'suspended') throw unauthorized('Session expired');

    setRefreshCookie(res, String(user._id));
    return send(res, {
      user: userToDTO(user),
      accessToken: signAccessToken({ sub: String(user._id), role: user.role, name: user.name }),
    });
  }),
);

router.post('/logout', (req, res) => {
  clearRefreshCookie(res);
  return send(res, { ok: true });
});

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth!.userId).lean();
    if (!user) throw unauthorized();
    const enrollments = await Enrollment.countDocuments({ student: req.auth!.userId });
    return send(res, { ...userToDTO(user), enrollmentCount: enrollments });
  }),
);

router.patch(
  '/me',
  requireAuth,
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.auth!.userId, { $set: req.body }, { new: true });
    if (!user) throw unauthorized();
    return send(res, userToDTO(user));
  }),
);

export default router;
