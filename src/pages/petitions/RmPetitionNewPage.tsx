import { Link } from 'react-router-dom';
import AppLayout from '@/components/lis/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function RmPetitionNewPage() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-black-500">คำขอแผนก RM (วัตถุดิบ)</h1>
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-grey-600">
              ฟอร์มของแผนก RM ยังอยู่ระหว่างการรวบรวมข้อมูลร่วมกับผู้ใช้งาน
            </p>
            <p className="text-sm text-grey-500">
              กฎ Production Plan และ Lab rule ของแผนกนี้ต่างจากแผนกผลิต — รอ requirement เพิ่มเติม
            </p>
            <Button asChild variant="primary-outline" size="sm">
              <Link to="/petitions/new">เลือกแผนกอื่น</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
