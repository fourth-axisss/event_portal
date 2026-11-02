/*import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/auth/Login';
import Dashboard from './pages/participant/Dashboard';
import BrowseEvents from './pages/participant/BrowseEvents';
import EventDetail from './pages/participant/EventDetail';
import MyRegistrations from './pages/participant/MyRegistrations';
import OrganizeHome from './pages/organize/OrganizeHome';
import EventForm from './pages/organize/EventForm';
import EventControl from './pages/organize/EventControl/EventControl';
import AdminLayout from './pages/admin/AdminLayout';
import Users from './pages/admin/Users';
import FestsClubs from './pages/admin/FestsClubs';
import DepartmentsVenues from './pages/admin/DepartmentsVenues';
import EventTypes from './pages/admin/EventTypes';
import { ROLES } from './utils/constants';

*/




import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/auth/Login';
import Dashboard from './pages/participant/Dashboard';
import BrowseEvents from './pages/participant/BrowseEvents';
import EventDetail from './pages/participant/EventDetail';
import MyRegistrations from './pages/participant/MyRegistrations';
import MyCertificates from './pages/participant/MyCertificates';
import OrganizeHome from './pages/organize/OrganizeHome';
import EventForm from './pages/organize/EventForm';
import EventControl from './pages/organize/EventControl/EventControl';
import AdminLayout from './pages/admin/AdminLayout';
import Users from './pages/admin/Users';
import FestsClubs from './pages/admin/FestsClubs';
import DepartmentsVenues from './pages/admin/DepartmentsVenues';
import EventTypes from './pages/admin/EventTypes';
import { ROLES } from './utils/constants';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/events" element={<BrowseEvents />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/me/registrations" element={<MyRegistrations />} />
          <Route path="/me/certificates" element={<MyCertificates />} />

          <Route path="/organize" element={<OrganizeHome />} />
          <Route path="/organize/new" element={<EventForm />} />
          <Route path="/organize/events/:id" element={<EventControl />} />
          <Route path="/organize/events/:id/edit" element={<EventForm />} />

          <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="users" replace />} />
              <Route path="users" element={<Users />} />
              <Route path="fests" element={<FestsClubs />} />
              <Route path="departments" element={<DepartmentsVenues />} />
              <Route path="event-types" element={<EventTypes />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}





/*

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/events" element={<BrowseEvents />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/me/registrations" element={<MyRegistrations />} />

          <Route path="/organize" element={<OrganizeHome />} />
          <Route path="/organize/new" element={<EventForm />} />
          <Route path="/organize/events/:id" element={<EventControl />} />
          <Route path="/organize/events/:id/edit" element={<EventForm />} />

          <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="users" replace />} />
              <Route path="users" element={<Users />} />
              <Route path="fests" element={<FestsClubs />} />
              <Route path="departments" element={<DepartmentsVenues />} />
              <Route path="event-types" element={<EventTypes />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


*/