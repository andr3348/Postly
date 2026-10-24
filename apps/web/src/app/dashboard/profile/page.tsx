import { ProfileCard } from "@/features/auth/components/ProfileCard";
import { SessionsCard } from "@/features/auth/components/SessionsCard";

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-5">
      <ProfileCard />
      <SessionsCard />
    </div>
  );
}
