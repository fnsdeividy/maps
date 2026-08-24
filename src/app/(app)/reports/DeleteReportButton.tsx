"use client";

export function DeleteReportButton({
  action,
  patientName,
  variant = "inline",
}: {
  action: () => Promise<void>;
  patientName: string;
  variant?: "inline" | "button";
}) {
  const buttonClass =
    variant === "button"
      ? "rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      : "text-red-600 hover:text-red-800 text-sm";

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            `Inativar laudo de ${patientName}? Esta ação pode ser revertida pelo administrador.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button className={buttonClass} type="submit">
        Excluir {variant === "button" ? "laudo" : null}
      </button>
    </form>
  );
}
