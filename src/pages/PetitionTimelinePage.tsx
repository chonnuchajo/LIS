import PetitionListPage from "./PetitionListPage";

export default function PetitionTimelinePage() {
  return (
    <PetitionListPage
      title="รายการคำร้อง"
      description="เลือกคำร้องเพื่อติดตามเวลา ความคืบหน้า กิจกรรม และเอกสาร"
      petitionDetailPath={(petition) => `/petition/${petition._id}`}
    />
  );
}
