import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/pagination'

interface MetricCardProps {
  title: string
  value: number
  icon: any
  growth?: number
  format?: 'number' | 'currency' | 'percentage'
  color?: string
}

interface MetricsCarouselProps {
  metrics: MetricCardProps[]
}

const MetricsCarousel = ({ metrics }: MetricsCarouselProps) => {
  const colorClasses = {
    blue: 'bg-gray-300',
    green: 'bg-gray-300',
    purple: 'bg-gray-300',
    orange: 'bg-gray-300',
    red: 'bg-gray-300'
  }

  const MetricCard = ({ 
    title, 
    value, 
    icon: Icon, 
    growth, 
    format = 'number',
    color = 'blue' 
  }: MetricCardProps) => {
    const formatValue = () => {
      switch (format) {
        case 'currency':
          return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 0
          }).format(value)
        case 'percentage':
          return `${value.toFixed(2)}%`
        default:
          return new Intl.NumberFormat('pt-BR').format(value)
      }
    }

    return (
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg ${colorClasses[color as keyof typeof colorClasses]} text-gray-700`}>
            <Icon className="w-5 h-5" />
          </div>
          {growth !== undefined && growth !== 0 && (
            <div className="flex items-center gap-1">
              {growth > 0 ? (
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              ) : growth < 0 ? (
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10h10" />
                </svg>
              ) : null}
              <span className={`text-sm font-medium ${growth > 0 ? 'text-green-600' : growth < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
        <p className="text-2xl font-bold text-gray-900">{formatValue()}</p>
      </div>
    )
  }

  return (
    <div className="md:hidden">
      <Swiper
        modules={[Pagination]}
        spaceBetween={16}
        slidesPerView={1.8}
        centeredSlides={true}
        pagination={{
          clickable: true,
          dynamicBullets: true,
        }}
        className="metrics-swiper"
      >
        {metrics.map((metric, index) => (
          <SwiperSlide key={index}>
            <MetricCard {...metric} />
          </SwiperSlide>
        ))}
      </Swiper>
      
      <style jsx>{`
        .metrics-swiper {
          padding-bottom: 40px;
        }
        .metrics-swiper .swiper-pagination {
          bottom: 0;
        }
        .metrics-swiper .swiper-pagination-bullet {
          background: #d1d5db;
          opacity: 0.5;
        }
        .metrics-swiper .swiper-pagination-bullet-active {
          background: #6b7280;
          opacity: 1;
        }

      `}</style>
    </div>
  )
}

export default MetricsCarousel 