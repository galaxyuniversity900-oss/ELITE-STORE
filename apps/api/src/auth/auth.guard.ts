import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

type AuthRequest = { headers: { authorization?: string }; user?: { id: string; email: string; role: string } };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authorization = request.headers.authorization ?? '';
    if (!authorization.startsWith('Bearer ')) throw new UnauthorizedException('Bearer access token required');
    request.user = await this.auth.authenticate(authorization.slice(7));
    return true;
  }
}
