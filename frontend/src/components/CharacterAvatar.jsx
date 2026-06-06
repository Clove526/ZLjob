export default function CharacterAvatar({ name, gender, customUrl, interviewerId, style, size = 'normal' }) {
  const sizeClass = size === 'large' ? 'avatar-large' : size === 'small' ? 'avatar-small' : 'avatar-normal'
  const primaryUrl = customUrl || getAvatarUrl(name, gender, interviewerId)

  return (
    <div className={`character-avatar ${sizeClass}`} style={style}>
      <img
        src={primaryUrl}
        alt={name}
        className="avatar-image"
        loading="lazy"
        onError={(e) => {
          e.target.src = getAvatarUrl(name, gender)
        }}
      />
    </div>
  )
}

const AVATAR_MAP = {
  p1: { gender: 'male', img: 32 }, p2: { gender: 'female', img: 45 },
  p3: { gender: 'male', img: 18 }, p4: { gender: 'male', img: 55 },
  p5: { gender: 'female', img: 38 }, p6: { gender: 'male', img: 27 },
  p7: { gender: 'female', img: 52 }, p8: { gender: 'male', img: 14 },
  p9: { gender: 'male', img: 63 }, p10: { gender: 'female', img: 41 },
}

function getAvatarUrl(name, gender, interviewerId) {
  const mapped = interviewerId ? AVATAR_MAP[interviewerId] : null
  if (mapped) {
    const genderPath = mapped.gender === 'female' ? 'women' : 'men'
    return `https://randomuser.me/api/portraits/${genderPath}/${mapped.img}.jpg`
  }
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i) + (i * 137)
    hash |= 0
  }
  const genderPath = gender === 'female' ? 'women' : 'men'
  const imageNum = ((hash % 70) + 70) % 70 + 1
  return `https://randomuser.me/api/portraits/${genderPath}/${imageNum}.jpg`
}
