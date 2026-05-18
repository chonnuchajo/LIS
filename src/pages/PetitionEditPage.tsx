import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AppLayout from '@/components/lis/AppLayout';
import { Button } from '@/components/ui/button';
import PetitionForm from '@/components/petition/PetitionForm';
import { updatePetition, usePetition } from '@/hooks/usePetition';
import { useAuth } from '@/hooks/useAuth';
import type { PetitionFormValues } from '@/lib/validations';

export default function PetitionEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error } = usePetition(id);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  return (
    <AppLayout>
        {loading ? (
          <p className="text-grey-500">กำลังโหลดข้อมูล...</p>
        ) : error || !data ? (
          <div className="rounded-[10px] border border-red-500 bg-red-50 p-4 text-sm text-red-500">
            โหลดข้อมูลไม่สำเร็จ: {error ?? 'ไม่พบคำร้อง'}
          </div>
        ) : data.status !== 'deliveringQC' ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/petitions/${id}`)}>
              <ArrowLeft className="h-4 w-4" />
              กลับไปหน้ารายละเอียด
            </Button>
            <div className="rounded-[10px] border border-yellow-500 bg-yellow-50 p-4 text-sm text-black-500">
              แก้ไขได้เฉพาะคำร้องที่อยู่ในสถานะ "กำลังส่งให้ QC" เท่านั้น
            </div>
          </div>
        ) : (
          (() => {
            const defaults: Partial<PetitionFormValues> = {
              serviceAgreement: {
                sampleDelivery: data.serviceAgreement?.sampleDelivery ?? 'self',
                testMethod: data.serviceAgreement?.testMethod ?? 'standard',
                testMethodDoneBefore: data.serviceAgreement?.testMethodDoneBefore ?? null,
                testMethodDetail: data.serviceAgreement?.testMethodDetail ?? '',
                testDuration: data.serviceAgreement?.testDuration ?? 'normal',
                testDurationDays: data.serviceAgreement?.testDurationDays ?? null,
                requireUncertainty: data.serviceAgreement?.requireUncertainty ?? false,
              },
              requester: {
                fullName: data.requester.fullName,
                department: data.requester.department,
                address: data.requester.address ?? '',
                phone: data.requester.phone ?? '',
                fax: data.requester.fax ?? '',
                email: data.requester.email ?? '',
                contactName: data.requester.contactName ?? '',
                position: data.requester.position ?? '',
              },
              sampleReturn: data.sampleReturn,
              testDelivery: data.testDelivery ?? [],
              reportCustomerName: data.reportCustomerName ?? 'ICP Ladda Co., LTD.',
              reportAddressType: data.reportAddressType ?? 'default',
              reportAddressOther: data.reportAddressOther ?? '',
              invoiceAddressType: data.invoiceAddressType ?? 'default',
              invoiceAddressOther: data.invoiceAddressOther ?? '',
              storageCondition: data.storageCondition,
              packageType: data.packageType,
              packageTypeOther: data.packageTypeOther ?? '',
              sampleSubmittedBy: data.sampleSubmittedBy ?? '',
              sampleSubmittedDate: data.sampleSubmittedDate
                ? new Date(data.sampleSubmittedDate).toISOString().slice(0, 10)
                : null,
              items: data.items.map((it) => ({
                seq: it.seq,
                sampleName: it.sampleName,
                commonName: it.commonName ?? '',
                batchNo: it.batchNo ?? '',
                productionDate: it.productionDate
                  ? new Date(it.productionDate).toISOString().slice(0, 10)
                  : null,
                submissionNo: it.submissionNo ?? '',
                packageUnit: it.packageUnit ?? '',
                testUnit: it.testUnit ?? '',
                testItems: it.testItems ?? '',
                note: it.note ?? '',
                labelManufacturer: it.labelManufacturer ?? '',
                labelSeller: it.labelSeller ?? '',
                labelQuantity: it.labelQuantity ?? '',
                labelSampledBy: it.labelSampledBy ?? '',
                labelSampledDate: it.labelSampledDate ?? '',
                labelRemark: it.labelRemark ?? '',
              })),
              cause: data.cause ?? '',
            };

            async function handleSubmit(values: PetitionFormValues) {
              if (!id) return;
              setSubmitting(true);
              setSubmitError(null);
              try {
                await updatePetition(id, values, user?.name || user?.email);
                navigate(`/petitions/${id}`);
              } catch (err) {
                const message =
                  typeof err === 'object' && err !== null && 'response' in err
                    ? (err as { response?: { data?: { error?: { message?: string } } } }).response
                        ?.data?.error?.message
                    : err instanceof Error
                      ? err.message
                      : null;
                setSubmitError(message ?? 'แก้ไขคำร้องไม่สำเร็จ');
              } finally {
                setSubmitting(false);
              }
            }

            return (
              <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/petitions/${id}`)}>
                  <ArrowLeft className="h-4 w-4" />
                  กลับ
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-black-500">
                    แก้ไขคำร้อง {data.petitionNo}
                  </h1>
                </div>
                {submitError && (
                  <div className="rounded-[10px] border border-red-500 bg-red-50 p-3 text-sm text-red-500">
                    {submitError}
                  </div>
                )}
                <PetitionForm
                  defaultValues={defaults}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                  submitLabel="บันทึกการแก้ไข"
                />
              </div>
            );
          })()
        )}
    </AppLayout>
  );
}
