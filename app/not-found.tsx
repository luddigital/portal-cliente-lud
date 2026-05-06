import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-t3">404</div>
        <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Não achei essa página.</h1>
        <Link href="/" className="mt-4 inline-block text-[13px] font-medium text-navy hover:underline">
          ← voltar pro dashboard
        </Link>
      </div>
    </div>
  );
}
