import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { generateToken } from '../middleware/auth';
import type { AuthUser, TokenResponse } from '../types';
import type { LoginInput, RegisterInput } from '../utils/validation';
import { AppError } from '../middleware/errorHandler';

export async function register(data: RegisterInput): Promise<TokenResponse> {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new AppError('El email ya está registrado', 409);
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const role = await prisma.role.findUnique({
    where: { name: data.role },
  });

  if (!role) {
    throw new AppError('Rol no válido', 400);
  }

  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      passwordHash,
      phone: data.phone,
      city: data.city,
      userRoles: {
        create: {
          roleId: role.id,
        },
      },
    },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  // Create professional profile if role is professional
  if (data.role === 'professional') {
    await prisma.professionalProfile.create({
      data: {
        userId: user.id,
      },
    });
  }

  const authUser: AuthUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    city: user.city,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isActive: user.isActive,
    roles: user.userRoles.map((ur) => ur.role.name),
  };

  const token = generateToken(user.id, user.email);

  return { user: authUser, token };
}

export async function login(data: LoginInput): Promise<TokenResponse> {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      professionalProfile: true,
    },
  });

  if (!user) {
    throw new AppError('Credenciales inválidas', 401);
  }

  if (!user.isActive) {
    throw new AppError('Tu cuenta está desactivada', 403);
  }

  const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);

  if (!isValidPassword) {
    throw new AppError('Credenciales inválidas', 401);
  }

  const authUser: AuthUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    city: user.city,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isActive: user.isActive,
    roles: user.userRoles.map((ur) => ur.role.name),
    professionalProfile: user.professionalProfile,
  };

  const token = generateToken(user.id, user.email);

  return { user: authUser, token };
}

export async function validateToken(userId: bigint, email?: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
      professionalProfile: true,
    },
  });

  if (!user || !user.isActive || (email && user.email !== email)) {
    return null;
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    city: user.city,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isActive: user.isActive,
    roles: user.userRoles.map((ur) => ur.role.name),
    professionalProfile: user.professionalProfile,
  };
}
