import { toast } from "sonner";

export function customConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const toastId = toast(message, {
      duration: Infinity,
      action: {
        label: "Confirm",
        onClick: () => {
          toast.dismiss(toastId);
          resolve(true);
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => {
          toast.dismiss(toastId);
          resolve(false);
        },
      },
      onDismiss: () => resolve(false),
      onAutoClose: () => resolve(false),
    });
  });
}
