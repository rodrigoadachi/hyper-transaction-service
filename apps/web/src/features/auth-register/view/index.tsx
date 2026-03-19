import { type FormEvent, useCallback, useState } from 'react';
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
import { useRegisterMutate } from '../model/queries';
import type { RegisterPayload } from '../model/types';

const validatePassword = (password: string): string | undefined => {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'A senha deve conter pelo menos uma letra maiúscula';
  if (!/[0-9]/.test(password)) return 'A senha deve conter pelo menos um número';
  return undefined;
};

export const RegisterView = () => {
  const router = useRouter();
  const registerMutate = useRegisterMutate();
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get('email') ?? '');
      const password = String(formData.get('password') ?? '');
      const passwordError = validatePassword(password);

      if (passwordError) {
        setValidationError(passwordError);
        return;
      }

      try {
        setValidationError(null);
        const payload: RegisterPayload = { email, password };
        await registerMutate.mutateAsync(payload);
        router.navigate({ to: '/login' });
      } catch {
        // handled by react-query error state
      }
    },
    [registerMutate, router],
  );

  const errorMessage =
    validationError || (registerMutate.isError ? (registerMutate.error as Error).message : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Registre-se na Hyper Finance</CardDescription>
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
            label={registerMutate.isPending ? 'Criando conta...' : 'Criar conta'}
            type="submit"
            className="w-full"
            disabled={registerMutate.isPending}
          />
        </form>
      </CardContent>
      <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
        Já tem conta?
        <Link to="/login" className={cn(buttonVariants({ variant: 'link' }), 'px-1')}>
          Entrar
        </Link>
      </CardFooter>
    </Card>
  );
};
