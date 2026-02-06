// components/customer/BottomNav.tsx
"use client"
import { Home, Search, Package, User, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useCartCount } from "@/components/cart/use-cart-count"

export function BottomNav() {
  const pathname = usePathname();
  const cartCount = useCartCount()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-mynavy border-t border-gray-200 dark:border-white/10 px-6 py-3 z-50">
      <div className="flex justify-between items-center max-w-md mx-auto">
        <NavItem href="/customer" icon={<Home />} label="Home" active={pathname === "/customer"} />
        <NavItem href="/customer/explore" icon={<Search />} label="Explore" active={pathname === "/customer/explore"} />
        <NavItem
          href="/customer/cart"
          icon={
            <span className="relative">
              <ShoppingCart />
              {cartCount > 0 ? (
                <span className="absolute -top-2 -right-2 bg-myamber text-mynavy text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              ) : null}
            </span>
          }
          label="Cart"
          active={pathname === "/customer/cart"}
        />
        <NavItem href="/customer/orders" icon={<Package />} label="Orders" active={pathname === "/customer/orders"} />
        <NavItem href="/customer/profile" icon={<User />} label="Me" active={pathname === "/customer/profile"} />
      </div>
    </nav>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link href={href} className={cn(
      "flex flex-col items-center gap-1 transition-colors",
      active ? "text-myamber" : "text-gray-400 hover:text-gray-600"
    )}>
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
    </Link>
  );
}
