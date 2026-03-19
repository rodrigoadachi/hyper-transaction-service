import { Input, type InputProps } from '../../atoms/Input';
import { Label } from '../../atoms/Label';
import type { useRender } from '@base-ui/react/use-render';
import { cn } from '../../lib/utils';

type LabelProps = useRender.ComponentProps<'label'>;

type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  labelProps?: Omit<LabelProps, 'htmlFor' | 'children'>;
  containerClassName?: string;
} & InputProps;

const FormField = ({
  id,
  label,
  error,
  className,
  labelProps,
  containerClassName,
  ...inputProps
}: FormFieldProps) => (
  <div className={cn('flex flex-col gap-1.5', containerClassName)}>
    <Label htmlFor={id} {...labelProps}>
      {label}
    </Label>
    <Input
      id={id}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      className={className}
      {...inputProps}
    />
    {error && (
      <p id={`${id}-error`} className="text-sm text-destructive">
        {error}
      </p>
    )}
  </div>
);

export type { FormFieldProps };
export { FormField };
