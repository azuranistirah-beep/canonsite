import ReceiptPage from '@/components/pages/ReceiptPage';

export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptPage id={id} />;
}
