"use client";
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'rg-btn inline-flex items-center justify-center gap-2 rounded-md type-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moloch-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'rg-btn-primary bg-moloch-500 text-scroll-100 hover:bg-moloch-800',
        secondary: 'rg-btn-secondary border-2 border-moloch-800 bg-scroll-100 text-moloch-800 hover:bg-moloch-800 hover:text-scroll-100',
        ghost: 'rg-btn-ghost bg-transparent text-moloch-500 hover:text-scroll-100/80',
        moloch: 'rg-btn-moloch bg-moloch-800 text-moloch-500 hover:bg-moloch-700',
      },
      size: {
        default: 'rg-btn-default px-8 py-3',
        sm: 'rg-btn-sm h-9 px-4',
        lg: 'rg-btn-lg h-12 px-10',
        icon: 'rg-btn-icon p-2',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  };

type AsChildElementProps = {
  className?: string;
  children?: React.ReactNode;
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, leftIcon, rightIcon, type, children, ...props }, ref) => {
    if (asChild) {
      if (!React.isValidElement(children)) return null;
      const child = React.Children.only(children) as React.ReactElement<AsChildElementProps>;
      const childContent = child.props?.children;

      const content = (
        <>
          {leftIcon ? (
            <span className="pointer-events-none inline-flex items-center justify-center [&>*]:size-[1.125rem]">{leftIcon}</span>
          ) : null}
          {childContent ? <span className="inline-flex items-center justify-center">{childContent}</span> : null}
          {rightIcon ? (
            <span className="pointer-events-none inline-flex items-center justify-center [&>*]:size-[1.125rem]">{rightIcon}</span>
          ) : null}
        </>
      );

      return React.cloneElement(child, {
        ...props,
        className: cn(buttonVariants({ variant, size }), className, child.props?.className),
        children: content,
      });
    }

    const content = (
      <>
        {leftIcon ? (
          <span className="pointer-events-none inline-flex items-center justify-center [&>*]:size-[1.125rem]">{leftIcon}</span>
        ) : null}
        {children ? <span className="inline-flex items-center justify-center">{children}</span> : null}
        {rightIcon ? (
          <span className="pointer-events-none inline-flex items-center justify-center [&>*]:size-[1.125rem]">{rightIcon}</span>
        ) : null}
      </>
    );

    return (
      <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} type={type ?? 'button'} {...props}>
        {content}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
export default Button;
