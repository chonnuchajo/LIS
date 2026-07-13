import PetitionListPage from "./PetitionListPage";

export default function PetitionTimelinePage() {
  return (
    <PetitionListPage
      title="Timeline คำร้อง"
      description="เลือกคำร้องเพื่อติดตามเวลา ความคืบหน้า กิจกรรม และเอกสาร"
      petitionDetailPath={(petition) => `/petition-timeline/${petition._id}`}
    />
  );
}
