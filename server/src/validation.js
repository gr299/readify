import { z } from 'zod';
import { ApiError } from './utils.js';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter and one number')
  .regex(/[0-9]/, 'Password must contain at least one letter and one number');

export const schemas = {
  register: z.object({
    name: z.string().trim().min(2, 'Name must be between 2 and 80 characters').max(80, 'Name must be between 2 and 80 characters'),
    email: z.string().trim().toLowerCase().email('A valid email is required').max(255),
    password,
  }),

  login: z.object({
    email: z.string().trim().toLowerCase().email('A valid email is required').max(255),
    password: z.string().max(128),
  }),

  articleCreate: z.object({
    title: z.string().trim().min(3, 'Title must be between 3 and 200 characters').max(200, 'Title must be between 3 and 200 characters'),
    author: z.string().trim().max(120, 'Author name is too long').optional().nullable(),
    category_id: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
      z.number().int().positive('Unknown category').nullable().optional()
    ),
    summary: z.string().trim().max(500, 'Summary must be at most 500 characters').optional().nullable(),
    content: z.string().max(500000, 'Article content is too large').optional().default(''),
    cover_image: z
      .preprocess((v) => (v === '' ? null : v), z.string().nullable().optional())
      .refine(
        (v) => v === null || v === undefined || /^\/uploads\/.+$/.test(v) || /^https?:\/\/.+$/.test(v),
        'Cover image must be an uploaded image or an http(s) URL'
      ),
    tags: z.array(z.string().max(40)).max(12, 'Too many tags').optional(),
    status: z.enum(['draft', 'pending', 'published', 'rejected', 'archived'], 'Invalid status').optional(),
  }),

  articleUpdate: z.object({
    title: z.string().trim().min(3, 'Title must be between 3 and 200 characters').max(200, 'Title must be between 3 and 200 characters').optional(),
    author: z.string().trim().max(120, 'Author name is too long').optional().nullable(),
    category_id: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
      z.number().int().positive('Unknown category').nullable().optional()
    ),
    summary: z.string().trim().max(500, 'Summary must be at most 500 characters').optional().nullable(),
    content: z.string().max(500000, 'Article content is too large').optional(),
    cover_image: z
      .preprocess((v) => (v === '' ? null : v), z.string().nullable().optional())
      .refine(
        (v) => v === null || v === undefined || /^\/uploads\/.+$/.test(v) || /^https?:\/\/.+$/.test(v),
        'Cover image must be an uploaded image or an http(s) URL'
      ),
    tags: z.array(z.string().max(40)).max(12, 'Too many tags').optional(),
    status: z.enum(['draft', 'pending', 'published', 'rejected', 'archived'], 'Invalid status').optional(),
  }),

  articleStatus: z.object({
    status: z.enum(['draft', 'pending', 'published', 'rejected', 'archived'], 'Invalid status'),
    rejection_reason: z.string().trim().max(500, 'Rejection reason is too long').optional().nullable(),
  }),

  comment: z.object({
    content: z.string().trim().min(1, 'Comment must be between 1 and 2000 characters').max(2000, 'Comment must be between 1 and 2000 characters'),
  }),

  reaction: z.object({
    type: z.enum(['like', 'love', 'fire', 'idea'], 'Invalid reaction type').optional(),
  }),

  profileUpdate: z.object({
    name: z.string().trim().min(2, 'Name must be between 2 and 80 characters').max(80, 'Name must be between 2 and 80 characters').optional(),
    bio: z.string().trim().max(500, 'Bio must be at most 500 characters').optional(),
    avatar: z
      .preprocess((v) => (v === '' || v === null || v === undefined ? null : v), z.string().nullable())
      .refine(
        (v) => v === null || v === undefined || /^\/uploads\/.+$/.test(v) || /^data:image\/.+$/.test(v) || /^https?:\/\/.+$/.test(v),
        'Avatar must be an uploaded image, data URI, or http(s) URL'
      )
      .optional(),
    website: z
      .preprocess((v) => (v === '' || v === null || v === undefined ? '' : v), z.union([z.literal(''), z.string().trim().url('Website must be a valid URL').max(300)]))
      .optional(),
    github: z.union([z.literal(''), z.string().trim().max(40, 'Username must be at most 40 characters').regex(/^[A-Za-z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores')]).optional(),
    twitter: z.union([z.literal(''), z.string().trim().max(40, 'Username must be at most 40 characters').regex(/^@?[A-Za-z0-9._-]+$/, 'Twitter handle may only contain letters, numbers, dots, dashes and underscores')]).optional(),
    google: z.union([z.literal(''), z.string().trim().max(40, 'Username must be at most 40 characters').regex(/^[A-Za-z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores')]).optional(),
    linkedin: z.union([z.literal(''), z.string().trim().max(40, 'Username must be at most 40 characters').regex(/^[A-Za-z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores')]).optional(),
  }),

  interests: z.object({
    tag_ids: z.array(z.number().int().positive('Invalid tag')).max(5, 'Choose up to 5 interests'),
  }),

  passwordChange: z.object({
    current_password: z.string().max(128),
    new_password: password,
  }),

  emailChange: z.object({
    new_email: z.string().trim().toLowerCase().email('A valid email is required').max(255),
    password: z.string().max(128),
  }),

  emailVerify: z.object({
    token: z.string().trim().min(1, 'Token is required').max(128),
  }),

  accountDelete: z.object({
    password: z.string().max(128),
  }),
};

// Express middleware: parses the request body against a zod schema and replaces
// req.body with the (coerced) parsed result. Fails with a 400 on the first error.
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues[0]?.message || 'Invalid input';
      return next(new ApiError(400, message));
    }
    req[source] = result.data;
    return next();
  };
}
