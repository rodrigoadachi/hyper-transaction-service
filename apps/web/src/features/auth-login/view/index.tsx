import { type FormEvent, useCallback } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormField,
  buttonVariants,
  cn,
} from '@hyper/ui';
import { Auth } from '../../../lib/auth';
import { useLoginMutate } from '../model/queries';

const auth = new Auth();

export const LoginView = () => {
  const router = useRouter();
  const loginMutate = useLoginMutate();

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get('email') ?? '');
      const password = String(formData.get('password') ?? '');

      try {
        const data = await loginMutate.mutateAsync({ email, password });
        auth.login(data.accessToken);
        router.navigate({ to: '/dashboard' });
      } catch {
        // handled by react-query error state
      }
    },
    [loginMutate, router],
  );

  const errorMessage = loginMutate.isError ? (loginMutate.error as Error).message : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse sua conta Hyper Finance</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          <FormField
            id="email"
            name="email"
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            required
          />
          <FormField
            id="password"
            name="password"
            label="Senha"
            type="password"
            placeholder="••••••••"
            required
          />
          <Button
            label={loginMutate.isPending ? 'Entrando...' : 'Entrar'}
            type="submit"
            className="w-full"
            disabled={loginMutate.isPending}
          />
        </form>
      </CardContent>
      <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
        Não tem conta?
        <Link to="/register" className={cn(buttonVariants({ variant: 'link' }), 'px-1')}>
          Criar conta
        </Link>
      </CardFooter>
    </Card>
  );
};
