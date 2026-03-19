import type * as React from 'react';
import { Badge } from '../Badge';

export type StatusBadgeProps = {
  status: string;
};

const StatusBadge = ({ status }: StatusBadgeProps): React.ReactElement => {
  if (status === 'COMPLETED') {
    return <Badge variant="success">{status}</Badge>;
  }
  if (status === 'PENDING') {
    return <Badge variant="warning">{status}</Badge>;
  }
  return <Badge variant="destructive">{status}</Badge>;
};

export { StatusBadge };
