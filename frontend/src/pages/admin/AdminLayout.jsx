import { Nav } from 'react-bootstrap';
import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <>
      <div className="page-header">
        <h1>Admin</h1>
        <p>Set up the people, fests and master data the portal runs on.</p>
      </div>

            <Nav variant="underline" className="section-tabs mb-4">
        <Nav.Link as={NavLink} to="/admin/users">Users</Nav.Link>
        <Nav.Link as={NavLink} to="/admin/fests">Fests &amp; clubs</Nav.Link>
        <Nav.Link as={NavLink} to="/admin/departments">Departments &amp; venues</Nav.Link>
        <Nav.Link as={NavLink} to="/admin/event-types">Event types</Nav.Link>
      </Nav>

      <Outlet />
    </>
  );
}