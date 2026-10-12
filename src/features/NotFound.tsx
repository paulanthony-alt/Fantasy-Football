import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/states';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <EmptyState
      className="py-24"
      icon={<Compass />}
      title="Page not found"
      description="That route doesn't exist. Use ⌘K to search for a player or tool."
      action={<Button asChild variant="primary"><Link to="/">Back to dashboard</Link></Button>}
    />
  );
}
