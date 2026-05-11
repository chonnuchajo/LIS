import type { Petition } from '@/types/petition.types';

// Phase 2: full agreement form layout. For now: a minimal print summary.
export default function PetitionPrintTemplate({ petition }: { petition: Petition }) {
  return (
    <div className="p-8 text-sm">
      <h2 className="text-xl font-bold mb-4 text-center">บันทึกข้อตกลงการให้บริการห้องปฏิบัติการ</h2>
      <p className="text-center text-xs mb-6">FM-QR-07-04-001-R00 · เลขที่: {petition.petitionNo}</p>

      <h3 className="font-semibold mt-4 mb-2">ผู้ยื่นคำร้อง</h3>
      <p>ชื่อ: {petition.requester.fullName} · แผนก: {petition.requester.department}</p>
      {petition.requester.email && <p>อีเมล: {petition.requester.email}</p>}
      {petition.requester.phone && <p>โทร: {petition.requester.phone}</p>}

      <h3 className="font-semibold mt-4 mb-2">รายการตัวอย่าง</h3>
      <table className="w-full border border-black border-collapse">
        <thead>
          <tr>
            <th className="border border-black p-1">#</th>
            <th className="border border-black p-1">ชื่อตัวอย่าง</th>
            <th className="border border-black p-1">Batch</th>
            <th className="border border-black p-1">รายการทดสอบ</th>
          </tr>
        </thead>
        <tbody>
          {petition.items.map((item) => (
            <tr key={item.seq}>
              <td className="border border-black p-1 text-center">{item.seq}</td>
              <td className="border border-black p-1">{item.sampleName}</td>
              <td className="border border-black p-1">{item.batchNo || '-'}</td>
              <td className="border border-black p-1">{item.testItems || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {petition.cause && (
        <>
          <h3 className="font-semibold mt-4 mb-2">สาเหตุ / ข้อมูลเพิ่มเติม</h3>
          <p className="whitespace-pre-wrap">{petition.cause}</p>
        </>
      )}
    </div>
  );
}
