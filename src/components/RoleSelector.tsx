import React from "react";
import type { Role, User } from "../types";
import { ROLE_CONFIGS } from "../constants";

interface RoleSelectorProps {
  currentRole: Role;
  currentUser: User | null;
  users: User[];
  onRoleChange: (role: Role) => void;
  onUserChange: (user: User) => void;
}

export function RoleSelector({
  currentRole,
  currentUser,
  users,
  onRoleChange,
  onUserChange
}: RoleSelectorProps) {
  const filteredUsers = users.filter(u => u.role === currentRole);

  return (
    <section className="panel role-selector">
      <div className="section-heading">
        <div>
          <p>角色切换</p>
          <h2>实验角色工作台</h2>
        </div>
      </div>
      <div className="role-cards">
        {ROLE_CONFIGS.map(config => (
          <article
            key={config.role}
            className={`role-card ${currentRole === config.role ? "role-active" : ""}`}
            onClick={() => {
              onRoleChange(config.role);
              const firstUser = users.find(u => u.role === config.role);
              if (firstUser) onUserChange(firstUser);
            }}
          >
            <div className="role-icon">{config.icon}</div>
            <h3>{config.label}</h3>
            <p>{config.description}</p>
          </article>
        ))}
      </div>
      <div className="user-select-wrap">
        <label>
          <span>选择用户（模拟登录）</span>
          <select
            value={currentUser?.id || ""}
            onChange={(e) => {
              const user = users.find(u => u.id === e.target.value);
              if (user) onUserChange(user);
            }}
          >
            {filteredUsers.map(user => (
              <option key={user.id} value={user.id}>
                {user.name}（{ROLE_CONFIGS.find(r => r.role === user.role)?.label}）
              </option>
            ))}
          </select>
        </label>
        {currentUser && (
          <div className="current-user-info">
            <span className="user-avatar">
              {ROLE_CONFIGS.find(r => r.role === currentUser.role)?.icon}
            </span>
            <div>
              <strong>{currentUser.name}</strong>
              <p>当前身份：{ROLE_CONFIGS.find(r => r.role === currentUser.role)?.label}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
