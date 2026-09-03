"use client";

import { deleteUserAction } from "./actions";

export default function DeleteUserButton({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  return (
    <form
      action={deleteUserAction}
      onSubmit={(e) => {
        if (!confirm(`Permanently delete ${name}? This removes their login and cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="user_id" value={userId} />
      <button
        type="submit"
        className="text-xs underline underline-offset-2 text-red-600 hover:opacity-70 dark:text-red-400"
      >
        Delete
      </button>
    </form>
  );
}
