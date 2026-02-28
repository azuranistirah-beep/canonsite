import ReceiptPage from '@/components/pages/ReceiptPage';

export default function Receipt({ params }: { params: { id: string } }) {
  return <ReceiptPage id={params.id} />;
}
