import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { useUiStateStore } from "@/stores/uiStateStore";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const { isRightSidebarOpen, isTopNavbarOpen, isFocusMode } = useUiStateStore();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      className="toaster group"
      style={{
        marginTop: isTopNavbarOpen && !isFocusMode ? '56px' : '0px',
        marginRight: isRightSidebarOpen && !isFocusMode ? '345px' : '0px',
        transition: 'margin 300ms ease-in-out',
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
