import { Avatar } from "./Avatar";

type ParticipantContact = {
  id: string;
  first_name: string;
  last_name: string;
};

/**
 * Stack of overlapping avatar circles. Used for showing event staff,
 * project teams, interaction participants, etc. at a glance.
 */
export function ParticipantStack({
  contacts,
  max = 4,
  size = 22,
}: {
  contacts: ParticipantContact[];
  max?: number;
  size?: number;
}) {
  const visible = contacts.slice(0, max);
  const overflow = contacts.length - visible.length;

  return (
    <div className="flex items-center">
      {visible.map((c, i) => (
        <div
          key={c.id}
          style={{
            marginLeft: i === 0 ? 0 : -size / 3,
            zIndex: visible.length - i,
            // Add a small white "halo" so the overlap reads as overlapping
            // instead of merging
            boxShadow: "0 0 0 2px white",
            borderRadius: "9999px",
          }}
        >
          <Avatar contact={c} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <span
          className="ml-1 text-[10px] text-zinc-500 font-medium"
          style={{ marginLeft: 4 }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
