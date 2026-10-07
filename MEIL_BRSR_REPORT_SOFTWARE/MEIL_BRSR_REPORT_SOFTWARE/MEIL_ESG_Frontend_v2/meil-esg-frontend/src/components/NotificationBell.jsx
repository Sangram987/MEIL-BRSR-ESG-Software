import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  Bell,
} from 'lucide-react';

import {
  relTime,
} from './ui';

import notificationApi from '../services/notificationApi';


export default function NotificationBell({
  dark = false,
}) {
  const nav =
    useNavigate();

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const ref =
    useRef(null);


  const load = async () => {
    try {
      const rows =
        await notificationApi.getNotifications();

      setNotifications(rows);
    } catch {
      setNotifications([]);
    }
  };


  useEffect(() => {
    load();

    const timer =
      setInterval(
        load,
        30000
      );

    return () =>
      clearInterval(timer);
  }, []);


  useEffect(() => {
    const handler =
      (event) => {
        if (
          ref.current &&
          !ref.current.contains(
            event.target
          )
        ) {
          setOpen(false);
        }
      };

    document.addEventListener(
      'mousedown',
      handler
    );

    return () =>
      document.removeEventListener(
        'mousedown',
        handler
      );
  }, []);


  const unread =
    notifications.filter(
      (n) => !n.read
    ).length;


  const markAll =
    async () => {
      try {
        await notificationApi.markAllAsRead();

        setNotifications(
          (current) =>
            current.map(
              (n) => ({
                ...n,
                read: true,
              })
            )
        );
      } catch {
        // Ignore UI error.
      }
    };


  const openNotification =
    async (item) => {
      if (!item.read) {
        try {
          const updated =
            await notificationApi.markAsRead(
              item.id
            );

          setNotifications(
            (current) =>
              current.map(
                (n) =>
                  n.id ===
                  item.id
                    ? updated
                    : n
              )
          );
        } catch {
          // Ignore read-state failure.
        }
      }

      setOpen(false);

      if (item.link) {
        nav(item.link);
      }
    };


  return (
    <div
      className="relative"
      ref={ref}
    >

      <button
        onClick={() =>
          setOpen(
            (value) => !value
          )
        }
        aria-label={`Notifications (${unread} unread)`}
        className={`relative p-2 rounded-lg transition ${
          dark
            ? 'text-slate-300 hover:bg-slate-800'
            : 'text-slate-500 hover:bg-slate-100'
        }`}
      >

        <Bell size={20} />

        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}

      </button>


      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,90vw)] bg-white border border-slate-200 rounded-xl shadow-xl z-[60] overflow-hidden text-slate-800">

          <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">

            <span className="text-sm font-bold">
              Notifications
            </span>

            {unread > 0 && (
              <button
                className="text-xs font-bold text-blue-600"
                onClick={
                  markAll
                }
              >
                Mark all read
              </button>
            )}

          </div>


          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">

            {notifications.length ===
              0 && (
              <p className="p-6 text-sm text-slate-500 text-center">
                You're all caught up.
              </p>
            )}


            {notifications
              .slice(0, 12)
              .map(
                (n) => (
                  <button
                    key={n.id}
                    onClick={() =>
                      openNotification(
                        n
                      )
                    }
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${
                      n.read
                        ? ''
                        : 'bg-blue-50/50'
                    }`}
                  >

                    <p className="text-sm text-slate-800">
                      {n.title &&
                        n.title !==
                          'Notification' && (
                          <b className="block mb-0.5">
                            {n.title}
                          </b>
                        )}

                      {n.text}
                    </p>

                    <p className="text-[11px] text-slate-400 mt-1">
                      {relTime(
                        n.at
                      )}
                    </p>

                  </button>
                )
              )}

          </div>

        </div>
      )}

    </div>
  );
}