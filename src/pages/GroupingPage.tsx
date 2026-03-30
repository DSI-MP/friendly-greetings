import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * V2: The old request-by-request grouping page is replaced.
 * Redirect to the TA Processing Queue which handles daily combined runs.
 */
export default function GroupingPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/ta/processing', { replace: true });
  }, [navigate]);
  return null;
}
