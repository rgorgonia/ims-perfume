"use client";

export default function ResetPasswordButton({
  action,
  userId,
  email,
}: {
  action: (formData: FormData) => Promise<void>;
  userId: string;
  email: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `Reset the password for ${email} to the default temporary password? Their current password will stop working immediately.`
          )
        ) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        className="text-xs underline underline-offset-2 hover:opacity-70"
      >
        Reset
      </button>
    </form>
  );
}
