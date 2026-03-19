import {
  Body,
  Controller,
  ConflictException,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { ZodValidationPipe } from '../../../../shared/infrastructure/pipes/zod-validation.pipe';
import { registerSchema, type RegisterDto } from './dtos/register.dto';
import { loginSchema, type LoginDto } from './dtos/login.dto';
import { ConflictError, UnauthorizedError } from '../../../../shared/domain/errors';
import { RegistrationGuard } from '../guards/registration.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  // ── POST /auth/register ───────────────────────────────────────────────────
  @Post('register')
  @UseGuards(RegistrationGuard)
  @ApiOperation({
    summary: 'Registrar novo usuário',
    description:
      'Cria uma nova conta de usuário.\n\n' +
      '**Regras de senha:** mínimo 8 caracteres, ao menos 1 letra maiúscula e 1 número.',
  })
  @ApiHeader({
    name: 'X-Registration-Token',
    description: 'Segredo pré-compartilhado exigido para habilitar o cadastro',
    required: true,
  })
  @ApiBody({
    description: 'Credenciais do novo usuário',
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'user@empresa.com',
          description: 'Endereço de e-mail (único por tenant)',
        },
        password: {
          type: 'string',
          minLength: 8,
          example: 'StrongPass123!',
          description: 'Mínimo 8 caracteres, ao menos 1 maiúscula e 1 número',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Usuário criado com sucesso',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid',
              example: '01945cf0-0000-7000-8000-000000000001',
              description: 'ID único do usuário (UUIDv7)',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@empresa.com',
            },
          },
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'E-mail já cadastrado para este tenant',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: { type: 'string', example: 'Email already in use' },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description: 'Dados inválidos — falha na validação do schema',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 422 },
        message: { type: 'string', example: 'Validation failed' },
        errors: {
          type: 'array',
          items: { type: 'object' },
          description: 'Lista de erros Zod',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'X-Registration-Token ausente ou inválido',
  })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
  ) {
    try {
      const data = await this.registerUseCase.execute(dto);
      return { data };
    } catch (err) {
      if (err instanceof ConflictError) throw new ConflictException(err.message);
      throw err;
    }
  }

  // ── POST /auth/login ──────────────────────────────────────────────────────
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autenticar usuário',
    description:
      'Autentica o usuário e retorna um **JWT Bearer token**.\n\n' +
      '- Algoritmo: **ES256** (ECDSA P-256, chave assimétrica)\n' +
      '- Expiração padrão: **15 minutos** (configurável via `JWT_EXPIRES_IN`)\n' +
      '- Proteção contra timing attack: hash dummy computado mesmo quando usuário não existe',
  })
  @ApiBody({
    description: 'Credenciais de autenticação',
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'user@empresa.com',
        },
        password: {
          type: 'string',
          minLength: 1,
          example: 'StrongPass123!',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Autenticação bem-sucedida — retorna JWT',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT Bearer token (ES256). Use no header: Authorization: Bearer <token>',
              example: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMTk0NWNmMCIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwOTAwfQ.signature',
            },
            expiresIn: {
              type: 'string',
              description: 'Duração de validade do token',
              example: '15m',
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Credenciais inválidas (e-mail ou senha incorretos)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid credentials' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description: 'Dados inválidos — falha na validação do schema',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 422 },
        message: { type: 'string', example: 'Validation failed' },
        errors: {
          type: 'array',
          items: { type: 'object' },
          description: 'Lista de erros Zod',
        },
      },
    },
  })
  async login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    try {
      const data = await this.loginUseCase.execute(dto);
      return { data };
    } catch (err) {
      if (err instanceof UnauthorizedError)
        throw new UnauthorizedException(err.message);
      throw err;
    }
  }
}
