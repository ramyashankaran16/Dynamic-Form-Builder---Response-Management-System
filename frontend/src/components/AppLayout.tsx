import ChecklistIcon from "@mui/icons-material/Checklist";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import HistoryIcon from "@mui/icons-material/History";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import {
  Avatar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Toolbar,
  Typography, useMediaQuery, useTheme,
} from "@mui/material";
import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { tokens } from "../theme";
import { BrandMark } from "./BrandMark";

const DRAWER_WIDTH = 240;

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
  match?: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <DashboardOutlinedIcon />, match: (p) => p === "/" },
  { to: "/forms", label: "Forms", icon: <DescriptionOutlinedIcon />, match: (p) => p.startsWith("/forms") },
  { to: "/my-submissions", label: "My submissions", icon: <ChecklistIcon /> },
  { to: "/activity", label: "Activity log", icon: <HistoryIcon /> },
  { to: "/users", label: "Users", icon: <PeopleOutlineIcon />, adminOnly: true },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, isAdmin, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const initials = (user?.full_name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: tokens.ink, color: "#E7ECF2" }}>
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <BrandMark light />
      </Box>
      <List component="nav" sx={{ px: 1.5, flex: 1 }}>
        {NAV.filter((n) => !n.adminOnly || isAdmin).map((item) => {
          const active = item.match ? item.match(pathname) : pathname.startsWith(item.to);
          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              onClick={onNavigate}
              sx={{
                borderRadius: 1.5,
                mb: 0.5,
                color: active ? "#fff" : "#B8C3CF",
                bgcolor: active ? "rgba(255,255,255,0.09)" : "transparent",
                borderLeft: `3px solid ${active ? tokens.highlighter : "transparent"}`,
                "&:hover": { bgcolor: "rgba(255,255,255,0.06)", color: "#fff" },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} slotProps={{ primary: { fontWeight: active ? 700 : 500, fontSize: 14.5 } }} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ p: 1.5, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <ListItemButton onClick={(e) => setAnchor(e.currentTarget)} sx={{ borderRadius: 1.5 }} aria-label="Account menu">
          <Avatar sx={{ width: 34, height: 34, mr: 1.5, bgcolor: tokens.ledger, fontSize: 14, fontWeight: 700 }}>{initials}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{user?.full_name}</Typography>
            <Typography noWrap sx={{ fontSize: 12.5, color: "#9AA7B5" }}>{user?.role}</Typography>
          </Box>
        </ListItemButton>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "top", horizontal: "left" }} transformOrigin={{ vertical: "bottom", horizontal: "left" }}>
          <MenuItem onClick={() => { setAnchor(null); onNavigate?.(); navigate("/profile"); }}>
            <ListItemIcon><PersonOutlineIcon fontSize="small" /></ListItemIcon>Profile
          </MenuItem>
          <MenuItem onClick={async () => { setAnchor(null); await logout(); navigate("/login"); }}>
            <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>Log out
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

export function AppLayout() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {desktop ? (
        <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH, flexShrink: 0, "& .MuiDrawer-paper": { width: DRAWER_WIDTH, border: 0 } }}>
          <SidebarContent />
        </Drawer>
      ) : (
        <Drawer open={open} onClose={() => setOpen(false)} sx={{ "& .MuiDrawer-paper": { width: DRAWER_WIDTH, border: 0 } }}>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </Drawer>
      )}
      <Box component="main" sx={{ flex: 1, minWidth: 0 }}>
        {!desktop && (
          <Toolbar sx={{ bgcolor: tokens.ink, color: "#fff", gap: 1 }}>
            <IconButton color="inherit" edge="start" onClick={() => setOpen(true)} aria-label="Open navigation">
              <MenuIcon />
            </IconButton>
            <BrandMark light />
          </Toolbar>
        )}
        <Box sx={{ p: { xs: 2, sm: 3, lg: 4 }, maxWidth: 1400, mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
