import { initialsOf } from "@/lib/format";

type AvatarContact = { first_name: string; last_name: string };

/**
 * Round avatar showing the contact's initials.
 *
 * No photo support yet — when we add `profile_photo_url` to contacts, this
 * is the one place to teach about it. Background and text use the maroon
 * tokens from the Tailwind theme.
 */
export function Avatar({
  contact,
  size = 36,
}: {
  contact: AvatarContact;
  size?: number;
}) {
  const initials = initialsOf(contact);
  const fontSize = Math.round(size * 0.36);

  return (
    <div
      className="flex items-center justify-center rounded-full font-medium select-none shrink-0 bg-maroon-50 text-maroon-700 border border-maroon-100"
      style={{ width: size, height: size, fontSize }}
    >
      {initials}
    </div>
  );
}
