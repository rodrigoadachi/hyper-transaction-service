import { type FormEvent, useCallback } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import {
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
  toastManager,
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

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get('email') ?? '');
      const password = String(formData.get('password') ?? '');
      const passwordError = validatePassword(password);

      if (passwordError) {
        toastManager.add({
          title: 'Erro ao criar conta',
          description: passwordError,
          type: 'error',
        });
        return;
      }

      try {
        const payload: RegisterPayload = { email, password };
        await registerMutate.mutateAsync(payload);
        toastManager.add({
          title: 'Conta criada com sucesso',
          description: 'Você será redirecionado para o login.',
          type: 'success',
        });
        await router.navigate({ to: '/login' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tente novamente em instantes.';

        toastManager.add({
          title: 'Erro ao criar conta',
          description: message,
          type: 'error',
        });
      }
    },
    [registerMutate, router],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Registre-se na Hyper Finance</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
