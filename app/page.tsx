import CompanionCard from "@/components/CompanionCard";
import CompanionsList from "@/components/CompanionsList";
import CTA from "@/components/CTA";
import {recentSessions} from "@/constants";
import {getAllCompanions, getRecentSessions} from "@/lib/actions/companion.actions";
import {getSubjectColor} from "@/lib/utils";

const Page = async () => {
    const companions = await getAllCompanions({ limit: 3 });
    const recentSessionsCompanions = await getRecentSessions(10);

  return (
    <main>
      <h1>Popular Companions</h1>

        <section className="home-section">
            {companions && companions.length > 0 ? (
                companions.map((companion) => (
                    <CompanionCard
                        key={companion.id}
                        {...companion}
                        color={getSubjectColor(companion.subject)}
                    />
                ))
            ) : (
                <div className="w-full text-center py-8">
                    <p className="text-gray-500">No companions available yet.</p>
                    <p className="text-gray-500 mt-2">Create your first companion to get started!</p>
                </div>
            )}
        </section>

        <section className="home-section">
            {recentSessionsCompanions && recentSessionsCompanions.length > 0 ? (
                <CompanionsList
                    title="Recently completed sessions"
                    companions={recentSessionsCompanions}
                    classNames="w-2/3 max-lg:w-full"
                />
            ) : (
                <article className="companion-list w-2/3 max-lg:w-full">
                    <h2 className="font-bold text-3xl">Recently completed sessions</h2>
                    <div className="w-full text-center py-8">
                        <p className="text-gray-500">No completed sessions yet.</p>
                        <p className="text-gray-500 mt-2">Start a session with a companion to see it here!</p>
                    </div>
                </article>
            )}
            <CTA />
        </section>
    </main>
  )
}

export default Page