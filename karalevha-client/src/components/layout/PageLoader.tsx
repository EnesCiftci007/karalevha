import { Loader2 } from 'lucide-react';

export function PageLoader() {
  return (
    <div className="flex justify-center items-center py-20 text-[#00e5ff]">
      <Loader2 className="w-10 h-10 animate-spin" />
    </div>
  );
}
