import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2.5 rounded-capsula border-2 border-transparent text-corpo font-extrabold whitespace-nowrap transition-all outline-none select-none focus-visible:shadow-foco active:translate-y-px disabled:pointer-events-none disabled:border-transparent disabled:bg-desativado disabled:text-desativado-texto aria-invalid:border-atraso [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6",
  {
    variants: {
      variant: {
        // Principal: Pinheiro + branco. Uma só por ecrã.
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        // Secundário: Menta + Pinheiro escuro.
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        // Destrutivo: branco com borda; só a confirmação final é cheia.
        destructive:
          "border-atraso-borda bg-branco text-atraso hover:bg-atraso-fundo",
        // Texto / ligação.
        link: "h-12 text-primary underline underline-offset-4",
      },
      size: {
        default: "h-botao w-full px-6",
        auto: "h-botao px-6",
        feito: "h-feito w-full px-6",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
