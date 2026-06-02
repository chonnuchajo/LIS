import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      duration={3000}
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast min-w-[320px] !rounded-2xl !border !p-5 !gap-3 !shadow-2xl backdrop-blur-sm data-[type=default]:!bg-background data-[type=default]:!text-foreground",
          title: "!text-base !font-semibold",
          description: "!text-sm !opacity-90",
          icon: "!w-5 !h-5 !mr-1",
          actionButton: "!rounded-lg group-[.toast]:!bg-primary group-[.toast]:!text-primary-foreground",
          cancelButton: "!rounded-lg group-[.toast]:!bg-muted group-[.toast]:!text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
